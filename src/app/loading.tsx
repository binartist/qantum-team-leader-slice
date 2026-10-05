import { AppBar } from "@/ui/AppBar";

export const metadata = { title: "Loading" };

export default function Loading() {
  return (
    <>
      <AppBar title="Loading" />
      <main>
        <p>Loading</p>
      </main>
    </>
  );
}
