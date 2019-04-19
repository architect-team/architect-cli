FROM architectio/architect-cli-base:latest

WORKDIR /usr/src/app
ENV ARCHITECT_PATH=~/.architect
ENV NODE_PATH=/usr/lib/node_modules:$NODE_PATH

ARG SERVICE_LANGUAGE
ENV SERVICE_LANGUAGE=${SERVICE_LANGUAGE}
ENV TARGET_PORT=8080
ENV PYTHONUNBUFFERED=true
ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

COPY . .

RUN npm config set unsafe-perm=true && \
  npm install -g @architect-io/${SERVICE_LANGUAGE}-launcher

CMD ["bash", "-c", "/usr/bin/architect-${SERVICE_LANGUAGE}-launcher --service_path=. --target_port=${TARGET_PORT}"]
EXPOSE 8080
