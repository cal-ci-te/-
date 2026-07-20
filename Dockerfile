FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY backend/ ./
ENV DB_PATH=/app/data/revachol.db
ENV PORT=9999
RUN mkdir -p /app/data /app/uploads/decos && chown -R node:node /app/data /app/uploads
USER node
EXPOSE 9999
CMD ["node", "server.cjs"]
