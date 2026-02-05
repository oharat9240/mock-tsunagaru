# HLSサポート付きnginx-rtmpをソースからビルド
FROM alpine:3.19 AS builder

RUN apk add --no-cache \
    build-base \
    pcre-dev \
    openssl-dev \
    zlib-dev \
    git

# nginx-rtmp-moduleをダウンロード
RUN git clone https://github.com/arut/nginx-rtmp-module.git /tmp/nginx-rtmp-module

# nginxをダウンロードしてビルド
ENV NGINX_VERSION=1.24.0
RUN wget http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz && \
    tar -zxvf nginx-${NGINX_VERSION}.tar.gz && \
    cd nginx-${NGINX_VERSION} && \
    ./configure \
        --prefix=/etc/nginx \
        --sbin-path=/usr/sbin/nginx \
        --conf-path=/etc/nginx/nginx.conf \
        --error-log-path=/var/log/nginx/error.log \
        --http-log-path=/var/log/nginx/access.log \
        --pid-path=/var/run/nginx.pid \
        --with-http_ssl_module \
        --with-http_realip_module \
        --add-module=/tmp/nginx-rtmp-module && \
    make && \
    make install

# 実行用イメージ
FROM alpine:3.19

RUN apk add --no-cache pcre openssl zlib

COPY --from=builder /usr/sbin/nginx /usr/sbin/nginx
COPY --from=builder /etc/nginx /etc/nginx

# 設定ファイルをコピー
COPY nginx.conf /etc/nginx/nginx.conf

# HLSディレクトリを作成
RUN mkdir -p /tmp/hls && chmod 777 /tmp/hls
RUN mkdir -p /var/log/nginx

EXPOSE 1935 8080

CMD ["nginx", "-g", "daemon off;"]
