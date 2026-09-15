package com.vyaparsamraj;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(exclude = { UserDetailsServiceAutoConfiguration.class })
@EnableJpaAuditing
public class VyaparSamrajApplication {
    public static void main(String[] args) {
        com.vyaparsamraj.config.DotenvLoader.loadEnv();
        SpringApplication.run(VyaparSamrajApplication.class, args);
    }
}
