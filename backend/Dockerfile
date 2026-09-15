# Build stage
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Cache Maven dependencies
COPY pom.xml .
RUN mvn dependency:resolve -B

# Copy source code and build production JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy the built Spring Boot JAR
COPY --from=build /app/target/vyapar-samraj-backend-1.0.0.jar app.jar

# Render dynamically injects the PORT environment variable (defaults to 8085 locally)
ENV PORT=8085
EXPOSE 8085

# Run the Spring Boot JAR
ENTRYPOINT ["java", "-jar", "app.jar"]
