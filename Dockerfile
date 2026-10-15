FROM node:22-bookworm

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

EXPOSE 8081
CMD ["npx", "expo", "start", "--tunnel", "--port", "8081"]
