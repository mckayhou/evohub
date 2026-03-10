use axum::{
    http::StatusCode,
    response::Json,
};

use crate::models::ApiResponse;

/// Error response handler
pub fn error_response(message: impl Into<String>) -> (StatusCode, Json<ApiResponse<()>>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiResponse::error(message)),
    )
}

/// Not found handler
pub fn not_found_response() -> (StatusCode, Json<ApiResponse<()>>) {
    (
        StatusCode::NOT_FOUND,
        Json(ApiResponse::error("Resource not found")),
    )
}

/// Unauthorized handler
pub fn unauthorized_response() -> (StatusCode, Json<ApiResponse<()>>) {
    (
        StatusCode::UNAUTHORIZED,
        Json(ApiResponse::error("Unauthorized")),
    )
}

/// Success response wrapper
pub fn success_response<T>(data: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse::success(data))
}
