const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const runFile = promisify(execFile);

const root = __dirname;
const imageDirectory = path.join(root, "images", "messier");
const dataDirectory = path.join(root, "data");
const results = {};
const headers = { "User-Agent":"MessierTrainer/1.0 (local educational app)" };
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url, attempts = 8) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok || response.status !== 429) return response;
      const retryAfter = Number(response.headers.get("retry-after")) || Math.min(20, attempt * 3);
      await sleep(retryAfter * 1000);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(Math.min(15, attempt * 3) * 1000);
    }
  }
  if (lastError) throw lastError;
  return fetch(url, { headers });
}

async function fetchBatch(numbers) {
  const params = new URLSearchParams({
    action:"query", format:"json", origin:"*", redirects:"1",
    prop:"pageimages|extracts|info", inprop:"url", exintro:"1", explaintext:"1",
    pithumbsize:"900", titles:numbers.map(number => `Messier ${number}`).join("|")
  });
  const response = await fetchWithRetry(`https://en.wikipedia.org/w/api.php?${params}`);
  if (!response.ok) throw new Error(`Wikipedia batch HTTP ${response.status}`);
  const payload = await response.json();
  const redirectedNumbers = new Map(
    (payload.query?.redirects || []).map(redirect => {
      const match = redirect.from?.match(/Messier\s+(\d+)/i);
      return [redirect.to, match ? Number(match[1]) : null];
    })
  );
  for (const page of Object.values(payload.query?.pages || {})) {
    const match = page.title?.match(/Messier\s+(\d+)/i);
    const number = match ? Number(match[1]) : redirectedNumbers.get(page.title);
    if (!number) continue;
    results[number] = {
      title:page.title || `Messier ${number}`,
      image:"",
      remoteImage:page.thumbnail?.source || "",
      extract:page.extract || "",
      url:page.fullurl || `https://en.wikipedia.org/wiki/Messier_${number}`
    };
  }
}

async function downloadImage(number) {
  const item = results[number];
  if (!item?.remoteImage) return;
  for (const extension of ["jpg", "png", "webp"]) {
    const candidate = `images/messier/m${number}.${extension}`;
    try {
      const stat = await fs.stat(path.join(root, candidate));
      if (stat.size > 1000) { item.image = candidate; delete item.remoteImage; console.log(`M${number} cached`); return; }
    } catch (error) {}
  }

  const temporary = path.join(imageDirectory, `m${number}.download`);
  await runFile("curl", ["-L", "--fail", "--silent", "--show-error", "--retry", "2", "--retry-all-errors", "--retry-delay", "1", "--connect-timeout", "10", "--max-time", "30", "-A", headers["User-Agent"], "-o", temporary, item.remoteImage]);
  const bytes = await fs.readFile(temporary);
  const extension = bytes[0] === 0x89 && bytes[1] === 0x50 ? "png" : bytes.toString("ascii", 0, 4) === "RIFF" ? "webp" : "jpg";
  item.image = `images/messier/m${number}.${extension}`;
  await fs.rename(temporary, path.join(root, item.image));
  delete item.remoteImage;
  console.log(`M${number} ✓`);
  await sleep(250);
}

async function downloadAll(numbers, concurrency = 4) {
  let cursor = 0;
  async function worker() {
    while (cursor < numbers.length) {
      const number = numbers[cursor++];
      try { await downloadImage(number); } catch (error) { console.error(`M${number}: ${error.message}`); }
    }
  }
  await Promise.all(Array.from({ length:concurrency }, worker));
}

async function main() {
  await fs.mkdir(imageDirectory, { recursive:true });
  await fs.mkdir(dataDirectory, { recursive:true });
  const all = Array.from({ length:110 }, (_, index) => index + 1);
  await fetchBatch(all.slice(0, 50));
  await fetchBatch(all.slice(50, 100));
  await fetchBatch(all.slice(100));

  all.forEach(number => {
    if (!results[number]) results[number] = { title:`Messier ${number}`, image:"", remoteImage:"", extract:"", url:`https://en.wikipedia.org/wiki/Messier_${number}` };
  });
  await downloadAll(all);
  all.forEach(number => delete results[number].remoteImage);
  const ordered = Object.fromEntries(all.map(number => [number, results[number]]));
  await fs.writeFile(path.join(dataDirectory, "messier.json"), JSON.stringify(ordered, null, 2) + "\n");
  console.log(`Saved ${Object.values(ordered).filter(item => item.image).length}/110 images.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
