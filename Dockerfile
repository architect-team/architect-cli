FROM architectio/architect-cli-base:latest

WORKDIR /usr/src/app
ENV ARCHITECT_PATH=~/.architect
ENV NODE_PATH=/usr/lib/node_modules:$NODE_PATH

ARG SERVICE_LANGUAGE
ENV SERVICE_LANGUAGE=${SERVICE_LANGUAGE}
ENV TARGET_PORT=8080
ENV PYTHONUNBUFFERED=true

COPY . .

RUN npm config set unsafe-perm=true && \
  npm install -g @architect-io/cli

CMD ["bash", "-c", "/usr/lib/node_modules/@architect-io/cli/node_modules/.bin/architect-${SERVICE_LANGUAGE}-launcher --service_path=. --target_port=${TARGET_PORT}"]
EXPOSE 8080
