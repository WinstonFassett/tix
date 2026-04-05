use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::Path,
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use notify::{Event, RecursiveMode, Watcher};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::broadcast;

use crate::tickets;

const INDEX_HTML: &str = include_str!("templates/index.html");

pub struct AppState {
    pub tx: broadcast::Sender<String>,
}

pub fn create_router(tx: broadcast::Sender<String>) -> Router {
    let state = Arc::new(AppState { tx });

    Router::new()
        .route("/", get(index_handler))
        .route("/api/tickets", get(list_tickets))
        .route("/api/tickets", post(create_ticket))
        .route("/api/tickets/{id}", post(update_ticket))
        .route("/ws", get(ws_handler))
        .with_state(state)
}

async fn index_handler() -> Html<&'static str> {
    Html(INDEX_HTML)
}

async fn list_tickets() -> impl IntoResponse {
    let tickets = tickets::read_all_tickets();
    Json(tickets)
}

#[derive(Deserialize)]
struct CreateTicketRequest {
    title: String,
    #[serde(rename = "type", default = "default_type")]
    ticket_type: String,
    #[serde(default = "default_priority")]
    priority: u8,
}

fn default_type() -> String {
    "task".to_string()
}
fn default_priority() -> u8 {
    2
}

async fn create_ticket(
    Json(payload): Json<CreateTicketRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Shell out to `tix add` CLI
    let output = tokio::process::Command::new("tix")
        .arg("add")
        .arg(&payload.title)
        .arg("-t")
        .arg(&payload.ticket_type)
        .arg("-p")
        .arg(payload.priority.to_string())
        .output()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to run tix: {}", e),
            )
        })?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok((StatusCode::CREATED, stdout))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err((StatusCode::INTERNAL_SERVER_ERROR, stderr))
    }
}

async fn update_ticket(
    Path(id): Path<String>,
    Json(updates): Json<serde_json::Value>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    tickets::update_ticket(&id, &updates).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(StatusCode::OK)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> impl IntoResponse {
    let rx = state.tx.subscribe();
    ws.on_upgrade(move |socket| handle_ws(socket, rx))
}

async fn handle_ws(socket: WebSocket, mut rx: broadcast::Receiver<String>) {
    let (mut sender, mut receiver) = socket.split();

    // Forward broadcast messages to this WebSocket client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Drain incoming messages (keep connection alive via ping/pong)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(_)) = receiver.next().await {}
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}

/// Spawn a file watcher that broadcasts "reload" on any change in tickets/.
pub fn spawn_file_watcher(tx: broadcast::Sender<String>) {
    let dir = tickets::tickets_dir();
    if !dir.exists() {
        eprintln!("warning: tickets directory {:?} does not exist yet", dir);
    }

    std::thread::spawn(move || {
        let tx2 = tx.clone();
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                // Only trigger on create/modify/remove of .md files
                let dominated_by_md = event.paths.iter().any(|p| {
                    p.extension().and_then(|e| e.to_str()) == Some("md")
                });
                if dominated_by_md {
                    let _ = tx2.send("reload".to_string());
                }
            }
        })
        .expect("Failed to create file watcher");

        let dir = tickets::tickets_dir();
        if dir.exists() {
            watcher
                .watch(&dir, RecursiveMode::Recursive)
                .expect("Failed to watch tickets directory");
        }

        // Park this thread forever so the watcher stays alive
        loop {
            std::thread::park();
        }
    });
}
