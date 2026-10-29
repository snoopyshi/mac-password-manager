use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

impl ApiError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
        }
    }

    pub fn not_initialized() -> Self {
        Self::new("NOT_INITIALIZED", "Vault has not been initialized")
    }

    pub fn already_initialized() -> Self {
        Self::new("ALREADY_INITIALIZED", "Vault is already initialized")
    }

    pub fn invalid_password() -> Self {
        Self::new("INVALID_PASSWORD", "Invalid master password")
    }

    pub fn vault_locked() -> Self {
        Self::new("VAULT_LOCKED", "Vault is locked")
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new("VALIDATION", message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("NOT_FOUND", message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("INTERNAL", message)
    }
}
