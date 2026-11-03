package com.zosh.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class FileService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".png", ".jpg", ".jpeg", ".webp", ".gif");
    private static final Map<String, String> EXTENSION_CONTENT_TYPES = Map.of(
            ".png", "image/png",
            ".jpg", "image/jpeg",
            ".jpeg", "image/jpeg",
            ".webp", "image/webp",
            ".gif", "image/gif"
    );
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024L; // 5MB

    private final Path fileStorageLocation;
    private final String publicBackendUrl;

    public FileService(
            @Value("${app.upload-dir:uploads}") String uploadDir,
            @Value("${app.backend-url:}") String publicBackendUrl
    ) {
        this.publicBackendUrl = publicBackendUrl;
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new RuntimeException("Could not create the directory where the uploaded files will be stored.", ex);
        }
    }

    public String uploadFile(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file must not be empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds maximum limit of 5MB");
        }

        String rawName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        String originalFileName = StringUtils.cleanPath(rawName);
        String fileExtension = "";
        int dotIndex = originalFileName.lastIndexOf(".");
        if (dotIndex >= 0) {
            fileExtension = originalFileName.substring(dotIndex).toLowerCase();
        }

        if (!ALLOWED_EXTENSIONS.contains(fileExtension)) {
            throw new IllegalArgumentException("Only image files (.png, .jpg, .jpeg, .webp, .gif) are allowed");
        }

        String contentType = file.getContentType();
        if (contentType != null
                && !contentType.toLowerCase().startsWith("image/")
                && !contentType.equalsIgnoreCase("application/octet-stream")) {
            throw new IllegalArgumentException("Invalid file content type. Only image files are allowed");
        }

        String newFileName = UUID.randomUUID() + fileExtension;
        Path targetLocation = this.fileStorageLocation.resolve(newFileName).normalize();
        if (!targetLocation.startsWith(this.fileStorageLocation)) {
            throw new IllegalArgumentException("Cannot store file outside upload directory");
        }

        Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

        if (publicBackendUrl != null && !publicBackendUrl.isBlank()) {
            String baseUrl = publicBackendUrl.trim().replaceAll("/+$", "");
            return baseUrl + "/api/media/download/" + newFileName;
        }

        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/media/download/")
                .path(newFileName)
                .toUriString();
    }

    public Resource download(String fileName) {
        try {
            Path filePath = this.fileStorageLocation.resolve(fileName).normalize();
            if (!filePath.startsWith(this.fileStorageLocation)) {
                throw new IllegalArgumentException("Invalid file path");
            }
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new RuntimeException("File not found " + fileName);
            }
        } catch (MalformedURLException ex) {
            throw new RuntimeException("File not found " + fileName, ex);
        }
    }

    public String getContentType(String fileName) {
        try {
            Path filePath = this.fileStorageLocation.resolve(fileName).normalize();
            if (!filePath.startsWith(this.fileStorageLocation)) {
                return "application/octet-stream";
            }
            String detected = Files.probeContentType(filePath);
            if (detected != null && !detected.isBlank()) {
                return detected;
            }
            int dotIdx = fileName != null ? fileName.lastIndexOf('.') : -1;
            if (dotIdx >= 0) {
                String ext = fileName.substring(dotIdx).toLowerCase();
                return EXTENSION_CONTENT_TYPES.getOrDefault(ext, "application/octet-stream");
            }
            return "application/octet-stream";
        } catch (IOException e) {
            return "application/octet-stream";
        }
    }
}
