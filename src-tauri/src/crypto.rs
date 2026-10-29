use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::Rng;

use crate::error::ApiError;

pub const ARGON_MEMORY_KIB: u32 = 64 * 1024;
pub const ARGON_ITERATIONS: u32 = 3;
pub const ARGON_PARALLELISM: u32 = 1;
pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 12;

#[derive(Debug, Clone)]
pub struct VaultMetaCrypto {
    pub salt: Vec<u8>,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub verifier_nonce: Vec<u8>,
    pub verifier_cipher: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct EncryptedBlob {
    pub nonce: Vec<u8>,
    pub cipher: Vec<u8>,
}

pub fn random_salt() -> Vec<u8> {
    random_bytes(SALT_LEN)
}

pub fn derive_key(
    master_password: &str,
    salt: &[u8],
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<[u8; 32], ApiError> {
    let params = Params::new(memory_kib, iterations, parallelism, Some(32))
        .map_err(|e| ApiError::internal(format!("Invalid Argon2 params: {e}")))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut output = [0u8; 32];
    argon
        .hash_password_into(master_password.as_bytes(), salt, &mut output)
        .map_err(|e| ApiError::internal(format!("Failed to derive key: {e}")))?;
    Ok(output)
}

pub fn encrypt_value(plaintext: &str, key: &[u8; 32]) -> Result<EncryptedBlob, ApiError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| ApiError::internal(format!("Failed to initialize cipher: {e}")))?;
    let nonce_bytes = random_bytes(NONCE_LEN);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| ApiError::internal(format!("Failed to encrypt value: {e}")))?;
    Ok(EncryptedBlob {
        nonce: nonce_bytes,
        cipher: ciphertext,
    })
}

pub fn decrypt_value(blob: &EncryptedBlob, key: &[u8; 32]) -> Result<String, ApiError> {
    if blob.nonce.len() != NONCE_LEN {
        return Err(ApiError::internal("Invalid nonce length"));
    }
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| ApiError::internal(format!("Failed to initialize cipher: {e}")))?;
    let nonce = Nonce::from_slice(&blob.nonce);
    let bytes = cipher
        .decrypt(nonce, blob.cipher.as_ref())
        .map_err(|_| ApiError::internal("Failed to decrypt value"))?;
    String::from_utf8(bytes).map_err(|e| ApiError::internal(format!("Invalid UTF-8 data: {e}")))
}

pub fn create_vault_meta(master_password: &str) -> Result<(VaultMetaCrypto, [u8; 32]), ApiError> {
    let salt = random_salt();
    let key = derive_key(
        master_password,
        &salt,
        ARGON_MEMORY_KIB,
        ARGON_ITERATIONS,
        ARGON_PARALLELISM,
    )?;
    let verifier = encrypt_value("vault-verifier-v1", &key)?;
    Ok((
        VaultMetaCrypto {
            salt,
            memory_kib: ARGON_MEMORY_KIB,
            iterations: ARGON_ITERATIONS,
            parallelism: ARGON_PARALLELISM,
            verifier_nonce: verifier.nonce,
            verifier_cipher: verifier.cipher,
        },
        key,
    ))
}

fn random_bytes(len: usize) -> Vec<u8> {
    let mut rng = rand::thread_rng();
    (0..len).map(|_| rng.gen::<u8>()).collect()
}
