const { app, Deta } = require("deta");
const axios = require("axios");

// add your Project Key
const deta = Deta(process.env.PROJECT_KEY);
//
// Envorment Varaibles
const db = deta.Base(process.env.DETABASE);
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);
const marginCall = process.env.MARGIN_CALL;
const liquidationCall = process.env.LIQUIDATION_CALL;
const PhoneNumber = process.env.PHONE_NUMBER_WITH_COUNTRY_CODE;

let btcprice = 0;

// define a function to run on a schedule
// the function must take an event as an argument
app.lib.cron(async (event) => {
  console.log("CRON running @ " + new Date().toLocaleTimeString());
  const resp = await getBitcoinPrice();
  const data = resp.data;
  console.log("Current BTC price ===>", data.price);
  btcprice = parseInt(data.price);
  //btcprice = 23000; this variable holds the btc price at that moment

  // hascalled is the key in the database, which stores if phone call made for liquidation/Margin conditions when the predefined criteria met.
  // Suppose if BTC price met Margin condition then a call will be made , once its made,the code is not going
  // to make a another call in the very next run even the condition satisfied.

  // querying the DB for the key `hascalled`
  let hasCalled = await db.get("hascalled");

  console.log("values from db for the key named hascalled is  -->", hasCalled);
  if (hasCalled == null) {
    // Runs for the very first time

    // initally set margin and liq to false for the key 'hascalled' in db
    const insertedkey = await db.put(
      { margin: false, liq: false },
      "hascalled"
    );

    hasCalled = insertedkey;
  }

  //_BTCValidation_Block_Margin
  if (hasCalled.margin == false) {
    // This block will get executed only if there was no liquidation call not made yet
    await _BTCValidationMargin();
  }

  //_BTCValidation_Block_Liquidation
  if (hasCalled.liq == false) {
    // This block will get executed only if there was no liquidation call not made yet
    await _BTCValidationliquid();
  }
});

const _BTCValidationMargin = async () => {
  if (btcprice < marginCall && btcprice > liquidationCall) {
    await getCallfromTwillo(process.env.TWILIO_MESSAGE_MARGIN, PhoneNumber);

    const updateState = await db.update({ margin: true }, "hascalled");
    console.log("DB UPDATED For Margin --->", updateState);
  }
};

const _BTCValidationliquid = async () => {
  if (btcprice < liquidationCall) {
    await getCallfromTwillo(process.env.TWILIO_MESSAGE_LIQ, PhoneNumber);

    const updateState = await db.update({ liq: true }, "hascalled");
    console.log("DB UPDATED For Liquid --->", updateState);
  }
};

const getCallfromTwillo = async (msg, _to) => {
  const call = await client.calls.create({
    twiml: `<Response><Say>${msg}</Say></Response>`,
    to: _to,
    from: process.env.TWILIO_PHONE_NUMBER,
  });
  console.log(call.sid);
};

const getBitcoinPrice = async () => {
  try {
    return await axios.get(
      "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
    );
  } catch (error) {
    console.error(error);
  }
};

module.exports = app;
