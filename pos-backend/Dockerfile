# Bước 1: Build file JAR bằng Maven
FROM maven:3.9.9-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Bước 2: Chạy ứng dụng với giới hạn RAM cho gói Free (512MB)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 5000
ENTRYPOINT ["java", "-Xmx350m", "-Xms256m", "-jar", "app.jar"]