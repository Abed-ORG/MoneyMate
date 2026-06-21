import type { IconType } from "react-icons";
import { BiMoviePlay } from "react-icons/bi";
import { FaBook } from "react-icons/fa";
import { FaCar, FaHouse } from "react-icons/fa6";
import { GiDelicatePerfume, GiHealthNormal } from "react-icons/gi";
import { HiOutlineShoppingBag } from "react-icons/hi2";
import { IoIosAirplane } from "react-icons/io";
import { IoBulbOutline, IoFastFoodOutline } from "react-icons/io5";
import { LuMessageCircleMore } from "react-icons/lu";
import {
  MdAttachMoney,
  MdOutlineLocalGroceryStore,
} from "react-icons/md";
import { normalizeCategory } from "../../constants/categories";

const categoryIconMap: Record<string, IconType> = {
  "Food & Dining": IoFastFoodOutline,
  Transport: FaCar,
  Housing: FaHouse,
  Groceries: MdOutlineLocalGroceryStore,
  Entertainment: BiMoviePlay,
  Shopping: HiOutlineShoppingBag,
  Healthcare: GiHealthNormal,
  Utilities: IoBulbOutline,
  Education: FaBook,
  Travel: IoIosAirplane,
  Income: MdAttachMoney,
  Other: LuMessageCircleMore,
  "Personal Care": GiDelicatePerfume,
};

type CategoryIconProps = {
  category: string;
  className?: string;
};

export function CategoryIcon({ category, className }: CategoryIconProps) {
  const normalized = normalizeCategory(category);
  const Icon = categoryIconMap[normalized] ?? categoryIconMap.Other;

  return <Icon aria-hidden="true" className={className} focusable="false" />;
}
