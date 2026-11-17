# Imagem do addon para qualquer hospedagem com Docker (Koyeb, Fly.io, Railway, VPS...).
# O addon não tem dependências externas: só precisa do Node 22.
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY src ./src
ENV NODE_ENV=production PORT=7100 REGION=BR LANGUAGE=pt-BR
EXPOSE 7100
# Passe TMDB_API_KEY ou TMDB_READ_TOKEN como variável de ambiente na hospedagem.
CMD ["node", "server.js"]
