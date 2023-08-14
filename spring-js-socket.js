// import SockJS from 'sockjs-client';
import { Client } from "@stomp/stompjs";
import { WebSocket } from "ws";
Object.assign(global, { WebSocket });
// let socket = new SockJS("ws://localhost:8080/ws");

import spawn from "child_process";

import SerialPort from "serialport";
import { sensitiveHeaders } from "http2";

import exec from "child_process";

import axios from "axios";

const actor = new SerialPort.SerialPort({ path: "COM7", baudRate: 9600 });
const sensor = new SerialPort.SerialPort({ path: "COM5", baudRate: 9600 });

const actorparser = new SerialPort.ReadlineParser();
const sensorparser = new SerialPort.ReadlineParser();

const raspiSerial = getRaspi();

actor.pipe(actorparser);
sensor.pipe(sensorparser);

function getRaspi() {
  //라즈베리파이 시리얼넘버 가져오기
  return new Promise(async (resolve, reject) => {
    exec.exec(
      "cat /proc/cpuinfo | grep Serial | awk '{print $3}'",
      (err, out, stderr) => {
        resolve(out);
      }
    );
  });
}

function readSerial(parser) {
  return new Promise((resolve, reject) => {
    parser.on("data", function (data) {
      resolve(data);
    });
  });
}

const test = async (message) => {
  console.log(message);
  const commands = {
    wind: { on: "a", off: "b" },
    led: { on: "c", off: "d" },
    water: { on: "e" },
  };
  actor.write(commands[message.split("-")[0]][message.split("-")[3]]);
  const readResult = await readSerial(actorparser);
  console.log(readResult);
};

const client = new Client({
  brokerURL: "ws://115.85.181.190:8080/ws",
  onConnect: async () => {
    console.log("connected");
    let readResult = await readSerial(actorparser); //액터 아두이노 초기화
    console.log(readResult);
    client.subscribe(`/sub/chat/room/${raspiSerial}`, (message) => {
      test(message.body);
    });
    // client.publish({destination: '/sub/chat/room/00000000', body: {roomId: "00000000", sender:"00000000", message: "ENTER"}})
  },
});

console.log(await readSerial(sensorparser)); //센서 아두이노 초기화

function execPython() {
  //yolov5 열매 데이터 가져옴
  return new Promise((resolve, reject) => {
    const process = spawn.spawn("python", ["../fruit-num/detect-for-node.py"]);
    process.stdout.on("data", function (data) {
      resolve(data.toString().replace(/\n/g, ""));
    });
  });
}

function getSensor() {
  //센서데이터 가져옴
  return new Promise(async (resolve, reject) => {
    sensor.write("a");
    const data = resolve(await readSerial(sensorparser));
  });
}

function sendData() {
  //일정시간마다 센서데이터 보냄
  setInterval(() => {
    let today = new Date();
    if (today.getMinutes() % 10 == 0) {
      request();
    }
  }, 1000 * 60);
}

async function request() {
  //axios 요청 함수
  const sensorData = await getSensor();
  const fruitNum = await execPython();
  const today = new Date();

  const year = today.getFullYear(); // 년도
  const month = today.getMonth() + 1; // 월
  const date = today.getDate(); // 날짜

  const hours = today.getHours(); // 시
  const minutes = today.getMinutes(); // 분
  const seconds = today.getSeconds(); // 초

  const time = `${year}-${month}-${date}T${hours}:${minutes}:${seconds}`;
  const meas = `${time}/${sensorData}`;
  try {
    const response = await axios.get(
      "http://115.85.181.190:8080/farm/insert-data",
      {
        params: { data: meas, fruitNum: fruitNum, farmNum: raspiSerial },
        withCredentials: true,
      }
    );
    console.log(response.config.params);
  } catch (error) {
    console.error(error);
  }
}

client.activate(); //웹소켓 연결

sendData(); //10분마다 센서데이터 보냄

// setTimeout(() => {//테스트용 센서데이터 한번 보냄
//   request();
// }, 5000);
