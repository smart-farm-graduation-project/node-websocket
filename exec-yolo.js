import spawn from "child_process";

function execPython() {
  return new Promise((resolve, reject) => {
    const process = spawn.spawn("python", ["../fruit-num/detect-for-node.py"]);
    process.stdout.on("data", function (data) {
      console.log(data.toString().replace(/\n/g, ""));
      resolve(data.toString().replace(/\n/g, ""));
    });
  });
}

const res = await execPython();
