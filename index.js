const { app, Deta } = require("deta");
const axios = require("axios");
const deta = Deta(process.env.PROJECT_KEY);

const db = deta.Base(process.env.DETABASE_NAME);
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);
const firstPrice = process.env.FIRST_PRICE;
const secondPrice = process.env.SECOND_PRICE;
const PhoneNumber = process.env.PHONE_NUMBER_WITH_COUNTRY_CODE;
const coinName = process.env.COINNAME;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const coinSymbol = process.env.COIN_SYMBOL_IN_BINANCE;

let coinPrice = 0;

app.lib.cron(async (event) => {
  // Logging here so that it can be seen on deta.sh Visor when it is being called
  console.log("Last run at " + new Date().toLocaleTimeString());

  const resp = await getCoinPrice();
  const data = resp.data;
  const coinPrice = parseInt(data.price);

  // Logging here so that it can be seen on deta.sh Visor
  console.log(`Price of ${coinName} is currently $${data.price}`);

  // Checking if a call reminder has been made already
  let reminderSent = await db.get("reminderSent");
  let consoleMsg = reminderSent
    ? "has been sent already 🙂"
    : "hasn't been sent till now 📈";

  // Logging here so that it can be seen on deta.sh Visor
  console.log(`The Reminder ${consoleMsg}`);

  // For the First Runtime of the Job
  if (reminderSent == null) {
    const insertedkey = await db.put(
      { firstReminder: false, secondReminder: false },
      "reminderSent"
    );
    reminderSent = insertedkey;
  }

  // If the reminder isn't sent yet
  if (reminderSent.firstReminder == false) {
    await FirstCaller();
  }

  // If the second reminder isn't sent yet
  if (reminderSent.secondReminder == false) {
    await SecondCaller();
  }
});

const FirstCaller = async () => {
  if (coinPrice < firstPrice && coinPrice > secondPrice) {
    await getCallfromTwillo(
      process.env.TWILIO_FIRST_PRICE_MESSAGE,
      PhoneNumber
    );

    const updateState = await db.update(
      { firstReminder: true },
      "reminderSent"
    );

    // Logging here so that it can be seen on deta.sh Visor
    console.log(`firstReminder in the base changed to: ${updateState}`);
  }
};

const SecondCaller = async () => {
  if (coinPrice < secondPrice) {
    await getCallfromTwillo(
      process.env.TWILIO_SECOND_PRICE_MESSAGE,
      PhoneNumber
    );

    const updateState = await db.update(
      { secondReminder: true },
      "reminderSent"
    );

    // Logging here so that it can be seen on deta.sh Visor
    console.log(`secondReminder in the base changed to: ${updateState}`);
  }
};

const getCallfromTwillo = async (msg, toNumber) => {
  const call = await client.calls.create({
    twiml: `<Response>
              <Say>
                ${msg}
              </Say>
            </Response>`,
    to: toNumber,
    from: twilioNumber,
  });

  // Logging here the Twilio response onto deta.sh Visor
  console.log(call.sid);
};

const getCoinPrice = async () => {
  try {
    return await axios.get(
      `https://api.binance.com/api/v3/ticker/price?symbol=${coinSymbol}USDT`
    );
  } catch (error) {
    // Logging the error details onto deta.sh Visor
    console.error(error);
  }
};

module.exports = app;
