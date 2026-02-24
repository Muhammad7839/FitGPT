package com.fitgpt.app.data.remote.dto

data class LoginRequest(val email: String, val password: String)

data class RegisterRequest(val name: String, val email: String, val password: String)

data class GuestRequest(val name: String)

data class UserDto(
    val id: Int,
    val name: String,
    val email: String? = null,
    val provider: String
)

data class AuthResponse(
    val token: String,
    val user: UserDto
)
