# MinIO no longer publishes free community images, so this builds the official
# open-source release (AGPLv3, github.com/minio/minio) at a pinned tag.
FROM golang:1.24-alpine AS build
ARG MINIO_RELEASE=RELEASE.2025-10-15T17-29-55Z
RUN apk add --no-cache git
RUN git clone --depth 1 --branch "${MINIO_RELEASE}" https://github.com/minio/minio.git /src
WORKDIR /src
RUN CGO_ENABLED=0 go build -trimpath -tags kqueue -ldflags "$(go run buildscripts/gen-ldflags.go)" -o /out/minio .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates curl \
    && adduser -D -H -u 1000 minio \
    && mkdir /data && chown minio /data
COPY --from=build /out/minio /usr/bin/minio
USER minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
