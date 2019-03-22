const bodyParser    = require("body-parser");
const cors          = require("cors");
const express       = require("express");
const plaid         = require("plaid");
const dotenv        = require("dotenv");
const Stripe        = require("stripe");
const stripe        = new Stripe("sk_test_xyns6NrOQuU8HhIbZ9JN9SMY");
const dwolla        = require("dwolla-v2");
const app           = express();

const accountUrl = "https://api-sandbox.dwolla.com/accounts/804b54fd-b99a-4edb-8250-d959fceae565";
const fundingUrl = "https://api-sandbox.dwolla.com/funding-sources/6da5d734-493b-4c9b-9268-17df0c6e5079";
dotenv.load();

const plaidClient = new plaid.Client(
    process.env.PLAID_CLIENT_ID,
    process.env.PLAID_SECRET,
    process.env.PUBLIC_KEY,
    plaid.environments.sandbox,
    {version: '2018-05-22'}
);

let appToken ;

const dwollaClient = new dwolla.Client({
    key : process.env.DWOLLA_APP_KEY,
    secret : process.env.DWOLLA_APP_SECRET,
    environment : 'sandbox'
})


getDwollaToken = () => {

    return new Promise((resolve, reject) => {
        dwollaClient.auth.client()
        .then(function(token) {
            appToken = token;
            resolve(appToken);
        })
        .catch((error) => {
            console.log("getDwollaToken : failed to generate dwolla token ,  error :: ", error);
            reject(error);
        })
    })
}

generateCustomerUrl = (requestBody, processorTokenRequest) => {

    // Create a customer on dwolla 

    let customer = {};

    console.log("request body : ", requestBody, "processorToken : ", processorTokenRequest);

    return new Promise((resolve, reject) => {
        getDwollaToken()
        .then((appToken) => {
            appToken.post('customers',requestBody)
        .then((res) => {
            customerUrl = res.headers.get('location');
            return customerUrl;
        })
        .then((customerUrl) => {
            customer.customerUrl = customerUrl;
        })
        .then(() => {
            plaidClient.createProcessorToken(processorTokenRequest.accessToken, processorTokenRequest.account_id,'dwolla', function(err, res){
                console.log(res);
                customer.processorToken = res.processor_token;
                resolve(customer);
                })
            });

        })
        .catch((error) => {
            console.log("error :  generateCustomerUrl :: ", error);
            reject(error);
        })
    })
}

generateCustomerFundingSource = (customer) => {

    // Attach a funding source to the customer .

    return new Promise((resolve, reject) => {

        let fundingRequestBody = {
            'plaidToken' : customer.processorToken,
            'name'       : "swapnil"
        };

        let fundingSourceUrl;

        getDwollaToken()
        .then((appToken) => {
            appToken.post(`${customer.customerUrl}/funding-sources`,fundingRequestBody)
            .then((res) => {
                fundingSourceUrl = res.headers.get('location');
                // console.log("funding source :",  customer.fundingSources);
                resolve(fundingSourceUrl);
            })
        })
        .catch((error) => {
            console.log("generateCustomerFundingSource : error :: ",error);
            reject(error);
        })        
    })
}

generateTransferRequest = (fundingSourceUrl) => {

    // Generate a transfer request to the customer's funding source.

    let transferRequest = {

        _links: {
            source: {
              href: `${fundingUrl}`
            },
            destination: {
              href: `${fundingSourceUrl}`
            }
          },
          amount: {
            currency: 'USD',
            value: '225.00'
        }
    };

    let transferRequestUrl;
    return new Promise((resolve, reject) => {
        getDwollaToken()
            .then((appToken) => {
                appToken.post('transfers', transferRequest)
                    .then((res) => {
                        transferRequestUrl = res.headers.get('location');
                        resolve(transferRequestUrl);
                })
                .catch((error) => {
                    console.log("generateTransferRequest : error :: ", error);
                    reject(error);
                })
            })
        })
    

}

app.use(bodyParser.urlencoded({
    extended : true
}));
app.use(cors());
app.use(bodyParser.json());
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
// rendering the initial page

app.get("/", (req, res, next) => {
    res.render('index');
})

app.post("/exchange_token", (req, res) => {

    let params = {
        public_token : req.body.public_token,
        account_id : req.body.account_id
    };

    let customer = {};

    plaidClient.exchangePublicToken(params.public_token)
    .then((publicTokenResponse) => {
        
        let access_token = publicTokenResponse.access_token;
        
        // create a dwolla customer

        let requestBody = {
            firstName   : "swapnil",
            lastName    : "kulkarni",
            email       : "test7@gmail.com",
            type        : "receive-only"
        };  

        let processorTokenRequest = {
            accessToken : publicTokenResponse.access_token,
            account_id  : params.account_id
        };
        
        generateCustomerUrl(requestBody,processorTokenRequest)
        .then((customer) => {
            return generateCustomerFundingSource(customer);
        })
        .then((customerFundingSourceUrl) => {
            return generateTransferRequest(customerFundingSourceUrl);
        })
        .then((response) => {
            console.log("final response : ", response);
        })
        .catch((error) => {
            console.log("Error in completing transaction : error :: ", error);
        })
        
    })
    .catch((error) => { 
        console.log(error);
        let result = handlePaymentError(error);
        console.log("error result : ",result)
    })
})

app.get("/sources", (req, res) => {

    stripe.customers.listSources(
        'cus_EZjjSjuXZI5C0W'
    )
    .then((response) => {
        console.log("list all cards response : ", response);
        res.status(200).send(response);
    })
    .catch((error) => {
        console.log("error : ", error);
        let errorResult = handlePaymentError(error);
        res.status(error.status_code).send(errorResult);
    })
})

app.post("/makeTransfer", (req,res) => {


})

handlePaymentError = function(error) {

    let errorString = "";

    switch(error.status_code) {  
        
        case 500 :
        case 400 :
        errorString = "Unable to complete your request.Please try again later.";
        break;

        case 404 :
        errorString = "Page not found."
        break;

        case 429 :
        errorString = "The request is valid but has exceeded established rate limits.";
        break;


        default : 
        break;
    }
    return errorString;

}
 
module.exports = app;
