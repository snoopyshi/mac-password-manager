#![cfg_attr(not(feature = "tauri-app"), allow(dead_code))]

mod clock;
mod crypto;
mod error;
mod models;
mod service;

#[cfg(feature = "tauri-app")]
use std::sync::Arc;

#[cfg(feature = "tauri-app")]
use tauri::{Manager, State};

#[cfg(feature = "tauri-app")]
use error::ApiError;
#[cfg(feature = "tauri-app")]
use models::{
    DeleteResponse, Entry, EntryCreatePayload, EntryListPayload, EntrySummary, EntryUpdatePayload,
    GenerateOptions, IdPayload, IdleTimeoutPayload, MasterPasswordPayload, PasswordOutput,
    VaultStatus,
};
#[cfg(feature = "tauri-app")]
use service::VaultService;

#[cfg(feature = "tauri-app")]
struct AppState {
    service: Arc<VaultService>,
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn vault_exists(state: State<'_, AppState>) -> Result<bool, ApiError> {
    state.service.vault_exists()
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn vault_setup(
    payload: MasterPasswordPayload,
    state: State<'_, AppState>,
) -> Result<VaultStatus, ApiError> {
    state.service.vault_setup(payload.master_password)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn vault_unlock(
    payload: MasterPasswordPayload,
    state: State<'_, AppState>,
) -> Result<VaultStatus, ApiError> {
    state.service.vault_unlock(payload.master_password)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn vault_lock(state: State<'_, AppState>) -> Result<VaultStatus, ApiError> {
    state.service.vault_lock()
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn vault_status(state: State<'_, AppState>) -> Result<VaultStatus, ApiError> {
    state.service.vault_status()
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn vault_touch(state: State<'_, AppState>) -> Result<VaultStatus, ApiError> {
    state.service.vault_touch()
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn vault_set_idle_timeout(
    payload: IdleTimeoutPayload,
    state: State<'_, AppState>,
) -> Result<VaultStatus, ApiError> {
    state.service.vault_set_idle_timeout(payload)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn entry_list(
    payload: EntryListPayload,
    state: State<'_, AppState>,
) -> Result<Vec<EntrySummary>, ApiError> {
    state.service.entry_list(payload)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn entry_get(payload: IdPayload, state: State<'_, AppState>) -> Result<Entry, ApiError> {
    state.service.entry_get(payload)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn entry_create(
    payload: EntryCreatePayload,
    state: State<'_, AppState>,
) -> Result<Entry, ApiError> {
    state.service.entry_create(payload)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn entry_update(
    payload: EntryUpdatePayload,
    state: State<'_, AppState>,
) -> Result<Entry, ApiError> {
    state.service.entry_update(payload)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn entry_delete(
    payload: IdPayload,
    state: State<'_, AppState>,
) -> Result<DeleteResponse, ApiError> {
    state.service.entry_delete(payload)
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
fn password_generate(
    options: Option<GenerateOptions>,
    state: State<'_, AppState>,
) -> Result<PasswordOutput, ApiError> {
    state
        .service
        .password_generate(options.unwrap_or_else(GenerateOptions::default))
}

#[cfg(feature = "tauri-app")]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("vault.sqlite3");
            app.manage(AppState {
                service: Arc::new(VaultService::new(db_path)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault_exists,
            vault_setup,
            vault_unlock,
            vault_lock,
            vault_status,
            vault_touch,
            vault_set_idle_timeout,
            entry_list,
            entry_get,
            entry_create,
            entry_update,
            entry_delete,
            password_generate
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}

#[cfg(not(feature = "tauri-app"))]
pub fn run() {
    eprintln!("Enable `tauri-app` feature to run the desktop shell.");
}
