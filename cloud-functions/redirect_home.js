function handler(event) {
  var request = event.request;
  var headers = request.headers;
  var host = request.headers.host.value;
  var enUrl = `https://en.${host}`;
  var trUrl = `https://tr.${host}`;
  var redirectUrl = enUrl;

  if (headers["accept-language"]) {
    var acceptLang = headers["accept-language"].value;
    if (acceptLang.includes("tr")) {
      redirectUrl = trUrl;
    }
  }

  var response = {
    statusCode: 302,
    statusDescription: "Found",
    headers: {
      location: { value: redirectUrl },
    },
  };

  return response;
}
