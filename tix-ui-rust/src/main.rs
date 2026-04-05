mod server;
mod tickets;

use clap::Parser;
use tokio::sync::broadcast;

#[derive(Parser)]
#[command(name = "tix-ui", about = "Web UI for tix ticket tracker")]
struct Cli {
    /// Port to listen on
    #[arg(short, long, default_value = "4488")]
    port: u16,

    /// Don't open browser automatically
    #[arg(long)]
    no_open: bool,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let addr = format!("127.0.0.1:{}", cli.port);

    let (tx, _rx) = broadcast::channel::<String>(64);

    // Start file watcher
    server::spawn_file_watcher(tx.clone());

    let app = server::create_router(tx);

    let tickets_dir = tickets::tickets_dir();
    println!("tix-ui starting");
    println!("  tickets: {}", tickets_dir.display());
    println!("  address: http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    if !cli.no_open {
        let url = format!("http://{}", addr);
        let _ = open::that(&url);
    }

    axum::serve(listener, app).await.expect("Server error");
}
