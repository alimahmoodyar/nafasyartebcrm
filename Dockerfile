FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/ ./
RUN dotnet restore --locked-mode && dotnet publish -c Release --no-restore -o /publish
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /publish .
ENV DATA_DIR=/data
VOLUME /data
ENTRYPOINT ["dotnet","Nafasyar.Api.dll"]
