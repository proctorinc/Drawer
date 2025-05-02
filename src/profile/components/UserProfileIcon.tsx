import type { User } from "@/api/Api";
import { cn, getTwoCapitalLetters, nameToColor } from "@/utils";
import type { FC } from "react";

type Props = {
    user?: User;
    onClick?: () => void;
    className?: string;
}

export const UserProfileIcon:FC<Props> = ({ user, onClick, className }) => {
    if (!user) {
        return <></>;
    }

    const name = getTwoCapitalLetters(user.name);
    const { primary, secondary, text } = nameToColor(name);

    return (
        <div
          className={cn("w-12 h-12 cursor-pointer select-none rounded-full font-semibold flex items-center justify-center hover:opacity-80 hover:scale-110 transition-all duration-300", className)}
          style={{ backgroundColor: primary }}
          onClick={onClick}
        >
          <p className="text-lg">{name}</p>
        </div>
    );
};