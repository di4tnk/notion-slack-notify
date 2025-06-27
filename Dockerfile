FROM node:20-slim

WORKDIR /workspace

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 8080

ENV PORT=8080
ENV FUNCTIONS_TARGET=notifySlack
ENV NODE_ENV=production

CMD ["node", "node_modules/@google-cloud/functions-framework/build/src/main.js", "--target=notifySlack", "--source=src"]