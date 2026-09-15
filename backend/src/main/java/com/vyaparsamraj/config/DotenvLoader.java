package com.vyaparsamraj.config;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class DotenvLoader {

    public static void loadEnv() {
        String[] candidatePaths = {
            "backend/.env",
            ".env",
            "backend/.env.local",
            ".env.local",
            "../.env.local",
            "../.env"
        };

        Map<String, String> loadedVars = new HashMap<>();

        for (String path : candidatePaths) {
            File file = new File(path);
            if (file.exists() && file.isFile()) {
                parseEnvFile(file, loadedVars);
            }
        }

        for (Map.Entry<String, String> entry : loadedVars.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (System.getenv(key) == null && System.getProperty(key) == null) {
                System.setProperty(key, value);
            }
        }

        resolveDatabaseUrl();
    }

    private static void parseEnvFile(File file, Map<String, String> targetMap) {
        try (BufferedReader reader = new BufferedReader(new FileReader(file, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                int eqIdx = line.indexOf('=');
                if (eqIdx > 0) {
                    String key = line.substring(0, eqIdx).trim();
                    String val = line.substring(eqIdx + 1).trim();
                    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                        if (val.length() >= 2) {
                            val = val.substring(1, val.length() - 1);
                        }
                    }
                    if (!targetMap.containsKey(key)) {
                        targetMap.put(key, val);
                    }
                }
            }
        } catch (IOException e) {
            // Ignore unreadable files
        }
    }

    private static void resolveDatabaseUrl() {
        String springUrl = getPropertyOrEnv("SPRING_DATASOURCE_URL");
        String dbUrl = getPropertyOrEnv("DATABASE_URL");
        String username = getPropertyOrEnv("SPRING_DATASOURCE_USERNAME");
        String password = getPropertyOrEnv("SPRING_DATASOURCE_PASSWORD");

        String rawUrl = (springUrl != null && !springUrl.isBlank()) ? springUrl : dbUrl;

        if (rawUrl != null && !rawUrl.isBlank()) {
            String jdbcUrl = rawUrl;

            if (jdbcUrl.startsWith("postgresql://") || jdbcUrl.startsWith("postgres://")) {
                try {
                    String cleanScheme = jdbcUrl.startsWith("postgresql://") ? jdbcUrl.substring(13) : jdbcUrl.substring(11);
                    int atIdx = cleanScheme.indexOf('@');
                    if (atIdx > 0) {
                        String userPass = cleanScheme.substring(0, atIdx);
                        String hostPath = cleanScheme.substring(atIdx + 1);
                        int colonIdx = userPass.indexOf(':');
                        if (colonIdx > 0) {
                            if (username == null) {
                                username = userPass.substring(0, colonIdx);
                                System.setProperty("SPRING_DATASOURCE_USERNAME", username);
                            }
                            if (password == null) {
                                password = userPass.substring(colonIdx + 1);
                                System.setProperty("SPRING_DATASOURCE_PASSWORD", password);
                            }
                        }
                        jdbcUrl = "jdbc:postgresql://" + hostPath;
                    } else {
                        jdbcUrl = "jdbc:postgresql://" + cleanScheme;
                    }
                } catch (Exception e) {
                    jdbcUrl = "jdbc:" + rawUrl;
                }
            } else if (!jdbcUrl.startsWith("jdbc:")) {
                jdbcUrl = "jdbc:" + jdbcUrl;
            }

            System.setProperty("SPRING_DATASOURCE_URL", jdbcUrl);
        }
    }

    private static String getPropertyOrEnv(String key) {
        String prop = System.getProperty(key);
        if (prop != null && !prop.isBlank()) {
            return prop;
        }
        String env = System.getenv(key);
        if (env != null && !env.isBlank()) {
            return env;
        }
        return null;
    }
}
