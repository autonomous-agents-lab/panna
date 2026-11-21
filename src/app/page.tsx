import { config } from "@/config";

export default function HomePage() {
  return (
    <main>
      <h1>{config.appName}</h1>
    </main>
  );
}
