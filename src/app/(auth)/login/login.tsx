'use client';

/* import { WelcomeToLens } from "@/app/login/WelcomeToLens"; */
import { useRouter } from "next/navigation";
/* import Coolha_beijingxiao from '@/public//logo/Coolha-beijingxiao.png'
import Image from "next/image"; */
import { Button } from "@/components/ui/button";
import { RxCross2 } from "react-icons/rx";

export function Login() {
    const router = useRouter()
    return (
        <div className=" w-full h-full fixed inset-0 flex justify-center items-center  z-50   transition-opacity duration-300 ease-in-out   bg-black/90" onClick={() => { router.back() }}>

            <div className=" w-11/12 md:w-[450px] rounded-2xl max-w-md  scale-95  transition-transform duration-300 ease-in-out transform bg-background z-auto border relative" onClick={(e) => e.stopPropagation()} >
                <div className="absolute top-2 right-2">
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { router.back() }}>
                        <RxCross2 className="w-5 h-5" />
                    </Button>
                </div>
                <figure>
{/*                     <Image
                        src={Coolha_beijingxiao}
                        alt="Coolha_beijingxiao"
                        sizes="100%"
                        style={{
                            width: '100%',
                            height: 'auto',
                        }}
                        className=" rounded-t-2xl"
                    /> */}
                </figure>
                <div className="p-6 border-opacity-50">
                    {/* <WelcomeToLens /> */}
                </div>
            </div>
        </div>
    );
}
