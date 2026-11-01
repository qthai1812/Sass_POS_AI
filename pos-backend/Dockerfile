# Sử dụng OpenJDK 17 làm base image
FROM eclipse-temurin:17-jdk-alpine

# Thiết lập thư mục làm việc bên trong container
WORKDIR /app

# Copy file jar được build vào container
COPY target/*.jar app.jar

# Expose cổng ứng dụng (ví dụ 5000 như cấu hình của bạn)
EXPOSE 5000

# Lệnh chạy ứng dụng
ENTRYPOINT ["java", "-jar", "app.jar"]