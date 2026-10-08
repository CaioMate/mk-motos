# Imagem usada para publicar o MK Motos na nuvem (Fly.io).
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# devDependencies são necessárias para o build do front (vite/tailwind)
RUN npm ci --include=dev

COPY . .
RUN npm run build

# Banco de dados, comprovantes e fotos ficam no disco permanente montado em /data
ENV MKMOTOS_DB=/data/mkmotos.db
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "servidor"]
