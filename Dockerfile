FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

# Create a persistent data directory
RUN mkdir -p /data

ENV DB_PATH=/data/pavecraft.db
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
