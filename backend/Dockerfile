# ──────────────────────────────────────────────
# Build Stage (.NET 10)
# ──────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files to restore dependencies
COPY ["SenicBilling.slnx", "./"]
COPY ["src/SenicBilling.API/SenicBilling.API.csproj", "src/SenicBilling.API/"]
COPY ["src/SenicBilling.Application/SenicBilling.Application.csproj", "src/SenicBilling.Application/"]
COPY ["src/SenicBilling.Domain/SenicBilling.Domain.csproj", "src/SenicBilling.Domain/"]
COPY ["src/SenicBilling.Infrastructure/SenicBilling.Infrastructure.csproj", "src/SenicBilling.Infrastructure/"]

RUN dotnet restore "src/SenicBilling.API/SenicBilling.API.csproj"

# Copy the rest of the source code and publish
COPY . .
WORKDIR "/src/src/SenicBilling.API"
RUN dotnet publish "SenicBilling.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# ──────────────────────────────────────────────
# Runtime Stage
# ──────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose standard port
EXPOSE 8080

ENTRYPOINT ["dotnet", "SenicBilling.API.dll"]
