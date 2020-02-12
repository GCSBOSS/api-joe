
FROM 'node:13-alpine'
ENV NODE_ENV production

EXPOSE 9000

WORKDIR /usr/src/app

RUN addgroup -g 2000 -S joe && \
    adduser -u 2000 -S joe -G joe && \
    chown joe:joe /usr/src/app

USER joe

COPY package*.json ./
RUN npm i -P
COPY . .

ENTRYPOINT ["node", "./bin/api-joe.js"]
