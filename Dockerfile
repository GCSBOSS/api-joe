
FROM 'node:13-alpine'
ENV NODE_ENV production

EXPOSE 80
EXPOSE 443

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm i -P
COPY . .

ENTRYPOINT ["node", "./bin/api-joe.js"]
