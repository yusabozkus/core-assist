# Payment Test Cards

Use these cards only in Paddle Sandbox. They do not make real payments.

| Card number | Test case | Expected result |
| --- | --- | --- |
| 4242 4242 4242 4242 | Successful payment | Payment succeeds without 3D Secure. |
| 4000 0566 5566 5556 | Visa debit payment | A valid Visa debit payment succeeds. |
| 4000 0038 0000 0446 | Payment with 3D Secure | Payment succeeds after the bank verification step. |
| 4000 0000 0000 0002 | Declined payment | The bank declines the payment. Use it to check error screens and backend handling. |
| 4000 0027 6000 3184 | Failed renewal | The first payment succeeds, but later payments fail. |

Use any cardholder name and a future expiry date. See the [official Paddle test card list](https://developer.paddle.com/concepts/payment-methods/card/) for more cases.
