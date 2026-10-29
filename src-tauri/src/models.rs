use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub initialized: bool,
    pub unlocked: bool,
    pub idle_timeout_sec: u32,
    pub last_active_at: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntrySummary {
    pub id: String,
    pub title: String,
    pub username: String,
    pub url: String,
    pub tags: Vec<String>,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntryInput {
    pub title: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MasterPasswordPayload {
    pub master_password: String,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IdPayload {
    pub id: String,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntryCreatePayload {
    pub entry: EntryInput,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntryUpdatePayload {
    pub id: String,
    pub entry: EntryInput,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntryListPayload {
    pub query: Option<String>,
    pub sort: Option<String>,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IdleTimeoutPayload {
    pub idle_timeout_sec: u32,
}

fn default_length() -> usize {
    16
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GenerateOptions {
    #[serde(default = "default_length")]
    pub length: usize,
    #[serde(default = "default_true")]
    pub uppercase: bool,
    #[serde(default = "default_true")]
    pub lowercase: bool,
    #[serde(default = "default_true")]
    pub digits: bool,
    #[serde(default = "default_true")]
    pub symbols: bool,
}

impl Default for GenerateOptions {
    fn default() -> Self {
        Self {
            length: default_length(),
            uppercase: true,
            lowercase: true,
            digits: true,
            symbols: true,
        }
    }
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PasswordOutput {
    pub password: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct DeleteResponse {
    pub ok: bool,
}
