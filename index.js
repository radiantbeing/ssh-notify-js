#!/usr/bin/env node

import path from "node:path";
import url from "node:url";
import os from "node:os";
import dotenv from "dotenv";
import undici from "undici";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

dotenv.config({
  path: path.join(__dirname, ".env")
});

function get_token() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function get_chat_id() {
  return process.env.TELEGRAM_CHAT_ID;
}

function get_datetime() {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false
  });
}

function get_hostname() {
  return os.hostname() ?? "알 수 없음";
}

function get_user() {
  return process.env.USER ?? "알 수 없음";
}

function get_ip() {
  const ip = process.env.SSH_CLIENT?.split(" ")[0];
  return ip ?? "알 수 없음";
}

function generate_message(context) {
  const { datetime, hostname, user, ip } = context;
  return `🚨 SSH 로그인이 감지되었습니다.
  
  • 일시: ${datetime}
  • 서버: ${hostname}
  • 사용자: ${user}
  • IP: ${ip}`;
}

async function send_message(text, options) {
  const { token, chat_id } = options;

  if (typeof token !== "string") {
    throw Error("token 매개변수에 문자열 값이 할당되지 않음.");
  }
  if (typeof chat_id !== "string") {
    throw Error("chat_id 매개변수에 문자열 값이 할당되지 않음.");
  }

  try {
    /*
     * Node.js v20 이상에서 불완전한 Happy Eyeballs 알고리즘
     * 구현으로 인해 `ETIMEDOUT` 에러가 발생함.
     * IPv4/IPv6 이중 스택 환경에서 IPv4 요청을 강제하기 위해
     * 에이전트를 재정의함.
     */
    const agent = new undici.Agent({
      connect: {
        family: 4
      }
    });
    const body = {
      chat_id: chat_id,
      text
    };
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        dispatcher: agent,
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify(body)
      }
    );
    await agent.close();

    if (!response.ok) {
      throw Error("Telegram 메시지 전송에 실패함.");
    }

    try {
      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: "INVALID_JSON" };
    }
  } catch (error) {
    return { ok: false, error: "REQUEST_FAIL" };
  }
}

(async function () {
  const message = generate_message({
    datetime: get_datetime(),
    hostname: get_hostname(),
    user: get_user(),
    ip: get_ip()
  });
  const token = get_token();
  const chat_id = get_chat_id();

  const result = await send_message(message, { token, chat_id });
  if (result.ok) {
    console.log("✅ 전송 성공: ", get_datetime());
  } else {
    console.error("❌ 전송 실패: ", get_datetime());
    console.error(result.error);
  }
})();
