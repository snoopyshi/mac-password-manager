mod stub_backend;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app_state = stub_backend::AppState::default();

  tauri::Builder::default()
    .manage(app_state)
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      stub_backend::vault_exists,
      stub_backend::vault_setup,
      stub_backend::vault_unlock,
      stub_backend::vault_lock,
      stub_backend::vault_status,
      stub_backend::vault_touch,
      stub_backend::vault_set_idle_timeout,
      stub_backend::entry_list,
      stub_backend::entry_get,
      stub_backend::entry_create,
      stub_backend::entry_update,
      stub_backend::entry_delete,
      stub_backend::password_generate,
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
