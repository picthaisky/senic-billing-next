namespace SenicBilling.Application.DTOs;

public record NotificationFeedItemDto(
    string Id,
    string Title,
    string Detail,
    string TimeLabel,
    DateTime OccurredAt,
    string Tone,
    string? Route
);

public record GlobalSearchItemDto(
    string Id,
    string Category,
    string Title,
    string Subtitle,
    string? Badge,
    string Route
);

public record GlobalSearchResponseDto(
    string Query,
    List<GlobalSearchItemDto> Items
);

public record TenantLogoUploadResultDto(
    string LogoUrl,
    string FileName
);

