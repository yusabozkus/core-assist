import { getProductScreenshots } from "@/lib/product-screenshots"
import { ProductTourSection } from "./product-tour-section"

export function ProductTour() {
  return <ProductTourSection screenshots={getProductScreenshots()} />
}
