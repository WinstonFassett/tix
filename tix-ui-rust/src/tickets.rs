use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Ticket {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub status: String,
    #[serde(default, rename = "type")]
    pub ticket_type: String,
    #[serde(default)]
    pub priority: Option<u8>,
    #[serde(default)]
    pub assignee: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub deps: Vec<String>,
    #[serde(default)]
    pub created: Option<String>,
    /// Markdown body after frontmatter
    #[serde(skip_deserializing)]
    pub body: String,
    /// Filename on disk
    #[serde(skip_deserializing)]
    pub filename: String,
}

/// Resolve the tickets directory.
/// Priority: TICKETS_DIR > TIX_WORKSPACE/tickets > TICKET_WORKSPACE/tickets > ./tickets
pub fn tickets_dir() -> PathBuf {
    if let Ok(d) = std::env::var("TICKETS_DIR") {
        return PathBuf::from(d);
    }
    if let Ok(ws) = std::env::var("TIX_WORKSPACE") {
        return PathBuf::from(ws).join("tickets");
    }
    if let Ok(ws) = std::env::var("TICKET_WORKSPACE") {
        return PathBuf::from(ws).join("tickets");
    }
    PathBuf::from("tickets")
}

/// Parse a single ticket markdown file. Returns None if parsing fails.
pub fn parse_ticket(path: &Path) -> Option<Ticket> {
    let content = fs::read_to_string(path).ok()?;
    let filename = path.file_name()?.to_string_lossy().to_string();

    // Extract YAML frontmatter between --- delimiters
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }
    let after_first = &trimmed[3..];
    let end_idx = after_first.find("\n---")?;
    let yaml_str = &after_first[..end_idx];
    let body_start = 3 + end_idx + 4; // skip past closing ---\n
    let body = if body_start < trimmed.len() {
        trimmed[body_start..].trim().to_string()
    } else {
        String::new()
    };

    let mut ticket: Ticket = serde_yaml::from_str(yaml_str).ok()?;
    ticket.body = body;
    ticket.filename = filename;
    Some(ticket)
}

/// Read all tickets from the tickets directory.
pub fn read_all_tickets() -> Vec<Ticket> {
    let dir = tickets_dir();
    let mut tickets = Vec::new();

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return tickets,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            if let Some(t) = parse_ticket(&path) {
                tickets.push(t);
            }
        }
    }

    // Sort by priority (high first), then title
    tickets.sort_by(|a, b| {
        let pa = a.priority.unwrap_or(99);
        let pb = b.priority.unwrap_or(99);
        pa.cmp(&pb).then_with(|| a.title.cmp(&b.title))
    });

    tickets
}

/// Update a ticket's frontmatter fields on disk.
pub fn update_ticket(id: &str, updates: &serde_json::Value) -> Result<(), String> {
    let dir = tickets_dir();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let trimmed = content.trim_start();
        if !trimmed.starts_with("---") {
            continue;
        }
        let after_first = &trimmed[3..];
        let end_idx = match after_first.find("\n---") {
            Some(i) => i,
            None => continue,
        };
        let yaml_str = &after_first[..end_idx];

        // Check if this is the right ticket
        let mut yaml_val: serde_yaml::Value =
            serde_yaml::from_str(yaml_str).map_err(|e| e.to_string())?;
        let ticket_id = yaml_val
            .get("id")
            .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| {
                v.as_u64().map(|n| format!("{:04x}", n))
            }))
            .unwrap_or_default();

        if ticket_id != id {
            // Also try numeric comparison (YAML may parse hex as int)
            let id_num = u64::from_str_radix(id, 16).unwrap_or(u64::MAX);
            let ticket_num = yaml_val.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
            if id_num != ticket_num {
                continue;
            }
        }

        // Merge updates into yaml_val
        if let Some(obj) = updates.as_object() {
            for (key, val) in obj {
                if key == "id" || key == "body" || key == "filename" {
                    continue; // don't allow changing id/body/filename via this
                }
                let yaml_key = if key == "ticket_type" { "type" } else { key };
                let yv = json_to_yaml(val);
                yaml_val[yaml_key] = yv;
            }
        }

        // Reconstruct the file
        let new_yaml = serde_yaml::to_string(&yaml_val).map_err(|e| e.to_string())?;
        let body_start = 3 + end_idx + 4;
        let body = if body_start < trimmed.len() {
            trimmed[body_start..].to_string()
        } else {
            String::new()
        };
        let new_content = format!("---\n{}---\n{}", new_yaml, body);
        fs::write(&path, new_content).map_err(|e| e.to_string())?;
        return Ok(());
    }

    Err(format!("Ticket {} not found", id))
}

fn json_to_yaml(val: &serde_json::Value) -> serde_yaml::Value {
    match val {
        serde_json::Value::Null => serde_yaml::Value::Null,
        serde_json::Value::Bool(b) => serde_yaml::Value::Bool(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_yaml::Value::Number(i.into())
            } else if let Some(f) = n.as_f64() {
                serde_yaml::Value::Number(serde_yaml::Number::from(f))
            } else {
                serde_yaml::Value::Null
            }
        }
        serde_json::Value::String(s) => serde_yaml::Value::String(s.clone()),
        serde_json::Value::Array(arr) => {
            serde_yaml::Value::Sequence(arr.iter().map(json_to_yaml).collect())
        }
        serde_json::Value::Object(obj) => {
            let map = obj
                .iter()
                .map(|(k, v)| (serde_yaml::Value::String(k.clone()), json_to_yaml(v)))
                .collect();
            serde_yaml::Value::Mapping(map)
        }
    }
}
