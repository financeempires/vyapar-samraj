package com.vyaparsamraj.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.vyaparsamraj.entity.Profile;
import jakarta.validation.constraints.*;

public record CreateUserRequest(
    @NotBlank @Size(min=3, max=50)
    @Pattern(regexp = "^[a-zA-Z0-9._@+\\-]+$", message = "Invalid username characters")
    String username,

    @NotBlank @Email String email,

    @JsonProperty("full_name")
    @JsonAlias("fullName")
    @NotBlank @Size(min=1, max=100) String fullName,

    @NotBlank String password,

    String phone,

    @JsonProperty("plan_id")
    @JsonAlias("planId")
    String planId,

    @JsonProperty("start_date")
    @JsonAlias("startDate")
    String startDate,

    @JsonProperty("end_date")
    @JsonAlias("endDate")
    String endDate,

    @JsonProperty("sub_admins")
    @JsonAlias("subAdmins")
    Integer subAdmins,

    Profile.UserRole role,

    Profile.UserStatus status,

    @Size(max=150) String organization
) {}
