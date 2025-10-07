import LeftPanel from "./(leftPanel)/LeftPanel";
import MiddleView from "./(middleView)/MiddleView";
import RightPanel from "./(rightPanel)/RightPanel";

export default function Home() {
  return (
    <>
      <section className="md:hidden h-dvh grid place-items-center p-6 text-center">
        <p className="text-sm">This experience isn’t available on mobile. Please use a larger screen.</p>
      </section>
      <section className="hidden md:grid h-dvh grid-cols-[320px_minmax(0,1fr)_360px]">
        <LeftPanel />
        <MiddleView />
        <RightPanel />
      </section>
    </>
  );
}
