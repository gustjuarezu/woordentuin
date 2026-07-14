import { Link } from "react-router-dom";
import { useApp } from "../store/useApp";
import { BrandMark, FlameIcon, LeafIcon } from "./icons";

export function TopBar() {
  const profile = useApp((s) => s.profile);
  return (
    <div className="bar">
      <Link to="/" className="brand" aria-label="Woordentuin home">
        <BrandMark />
        <span>
          Woordentuin <small>Nederlands</small>
        </span>
      </Link>
      <div className="stats">
        <div className="chip streak" title="Day streak">
          <FlameIcon />
          <span>{profile.streak}</span>
        </div>
        <div className="chip xp" title="Total XP">
          <LeafIcon />
          <span>{profile.xp} XP</span>
        </div>
      </div>
    </div>
  );
}
