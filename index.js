const fs = require("fs");
const { Client } = require("discord.js-selfbot-v13");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

const tokenChannelPairs = fs
  .readFileSync("tokens.txt", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((x) => x.trim().split(":"));


const tokenStatus = {
  spamming: [],
  invalid: [],
  missingAccess: []
};

function startSpam(bot) {
  if (!bot.spammingChannel) {
    console.error(`No spamming channel set for ${bot.user.tag}`);
    return;
  }
  console.log(`Starting spamming in channel: ${bot.spammingChannel.id} for ${bot.user.tag}`);

  const messages = fs.readFileSync("messages.txt", "utf8").split("\n").filter(Boolean);
  let messageIndex = 0;

  const spamLoop = () => {
    if (bot.spamming) {
      const messageToSend = messages[messageIndex];
      bot.spammingChannel.send(messageToSend).catch((error) =>
        console.error(`Failed to send message for ${bot.user.tag}:`, error)
      );
      messageIndex = (messageIndex + 1) % messages.length; 
      setTimeout(spamLoop, 3000);
    } else {
      console.log(`Spamming paused for ${bot.user.tag}`);
    }
  };

  spamLoop();
}

function reportTokenStatus() {
  console.log("\n=== Token Status Report ===");
  console.log(`Total tokens processed: ${tokenChannelPairs.length}`);
  console.log(`Fully spamming tokens: ${tokenStatus.spamming.length}`);
  tokenStatus.spamming.forEach(([token, channelId]) =>
    console.log(`  Spamming - Token: ${token}, Channel: ${channelId}`)
  );
  console.log(`Invalid tokens: ${tokenStatus.invalid.length}`);
  tokenStatus.invalid.forEach(([token, channelId]) =>
    console.log(`  Invalid - Token: ${token}, Channel: ${channelId}`)
  );
  console.log(`Tokens missing channel access: ${tokenStatus.missingAccess.length}`);
  tokenStatus.missingAccess.forEach(([token, channelId]) =>
    console.log(`  Missing Access - Token: ${token}, Channel: ${channelId}`)
  );
  console.log("========================\n");
}

function handleReady(bot) {
  console.log(`Logged in as \x1b[34m${bot.user.tag}\x1b[0m!`);
  bot.channels
    .fetch(bot.channelId)
    .then((channel) => {
      bot.spammingChannel = channel;

      const batchSize = 50;
      const batchIndex = Math.floor(bot.index / batchSize); 
      const positionInBatch = bot.index % batchSize;
      const batchDelay = batchIndex * 1500;
      const staggerDelay = positionInBatch * 20;
      const initialDelay = batchDelay + staggerDelay;

      bot.spamming = true;

      tokenStatus.spamming.push([bot.token, bot.channelId]);
      setTimeout(() => {
        startSpam(bot);
      }, initialDelay);
    })
    .catch((error) => {
      console.error(`Failed to fetch channel ${bot.channelId} for ${bot.user.tag}:`, error);
      tokenStatus.missingAccess.push([bot.token, bot.channelId]);
    });

  bot.on("messageCreate", (message) => {
    if (message.author.bot || message.channel.id !== bot.channelId) return;

    if (message.content === "!start") {
      if (!bot.spamming) {
        bot.spamming = true;
        console.log(`Resuming spamming for ${bot.user.tag}`);
        startSpam(bot);
      }
    }

    if (message.content === "!stop") {
      bot.spamming = false;
      console.log(`Spamming stopped for ${bot.user.tag}`);
    }
  });
}

let botsProcessed = 0;
const totalBots = tokenChannelPairs.length;

tokenChannelPairs.forEach(([token, channelId], index) => {
  const bot = new Client();
  bot.channelId = channelId;
  bot.index = index;
  bot.token = token;
  bot.on("ready", () => {
    handleReady(bot);
    botsProcessed++;
    if (botsProcessed === totalBots) {
      reportTokenStatus();
    }
  });
  bot
    .login(token)
    .catch((error) => {
      console.error(`\x1b[31mInvalid token: ${token}\x1b[0m`, error);
      tokenStatus.invalid.push([token, channelId]);
      botsProcessed++;
      if (botsProcessed === totalBots) {
        reportTokenStatus();
      }
    });
});

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});