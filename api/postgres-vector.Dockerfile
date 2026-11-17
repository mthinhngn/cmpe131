FROM postgres:17-alpine AS vector-build
ARG PGVECTOR_VERSION=0.8.7
RUN apk add --no-cache build-base git \
    && git clone --branch "v${PGVECTOR_VERSION}" --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && make -C /tmp/pgvector OPTFLAGS="" with_llvm=no \
    && make -C /tmp/pgvector install DESTDIR=/vector with_llvm=no \
    && mkdir -p /vector/usr/share/licenses/pgvector \
    && cp /tmp/pgvector/LICENSE /vector/usr/share/licenses/pgvector/LICENSE

FROM postgres:17-alpine
COPY --from=vector-build /vector/ /
