import {
  initializePaddle,
  type Paddle,
  type PaddleEventData,
} from "@paddle/paddle-js"

let paddlePromise: Promise<Paddle> | null = null
const paddleEventListeners = new Set<(event: PaddleEventData) => void>()

export function subscribeToPaddleEvents(
  listener: (event: PaddleEventData) => void
) {
  paddleEventListeners.add(listener)
  return () => paddleEventListeners.delete(listener)
}

export function getPaddle() {
  if (paddlePromise) return paddlePromise

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim()
  if (!token) {
    throw new Error("Paddle istemci anahtarı yapılandırılmamış.")
  }

  const environment =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? "production"
      : "sandbox"

  paddlePromise = initializePaddle({
    token,
    environment,
    eventCallback: (event) => {
      paddleEventListeners.forEach((listener) => listener(event))
    },
  })
    .then((paddle) => {
      if (!paddle) {
        paddlePromise = null
        throw new Error("Paddle ödeme ekranı yüklenemedi.")
      }
      return paddle
    })
    .catch((error: unknown) => {
      paddlePromise = null
      throw error
    })

  return paddlePromise
}
