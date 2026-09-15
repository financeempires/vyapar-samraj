package com.vyaparsamraj.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.vyaparsamraj.entity.Profile;
import jakarta.validation.constraints.*;

/** PATCH /api/users/{id} — all fields optional */
public record UpdateUserRequest(
    @JsonProperty("full_name")
    @JsonAlias("fullName")
    @Size(min=1, max=100) String fullName,

    @Email String email,

    String password,

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

    Profile.UserStatus status,

    Profile.UserRole role,

    @Size(max=150) String organization
) {}
