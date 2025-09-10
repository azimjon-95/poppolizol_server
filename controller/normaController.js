const Norma = require("../model/productNormaSchema");
const Material = require("../model/wherehouseModel");
const response = require("../utils/response");
const FinishedProducts = require("../model/finishedProductModel");
const mongoose = require("mongoose");

class NormaController {
  async getNorma(req, res) {
    try {
      const norma = await Norma.find().populate({
        path: "materials.materialId",
      });
      if (!norma.length) {
        return response.notFound(res, "Normalar topilmadi!");
      }
      return response.success(res, "Barcha normalar", norma);
    } catch (error) {
      return response.serverError(
        res,
        "Ma'lumotlarni olishda xato yuz berdi",
        error.message
      );
    }
  }

  async createNorma(req, res) {
    try {
      const { productName, category, salePrice, materials, description } =
        req.body;

      // Validate required fields
      if (!productName || !materials) {
        return response.error(
          res,
          "Mahsulot nomi, materiallar yoki xarajatlar kiritilmagan"
        );
      }
      const prodName = await Norma.findOne({ productName });
      if (prodName) {
        return response.error(res, "Bunday mahsulot normasi allaqachon mavjud");
      }

      // Fetch material data
      const materialData = await Material.find().select("price");
      if (!materialData || materialData.length === 0) {
        return response.error(res, "Material ma'lumotlari topilmadi");
      }

      // Calculate material cost
      let materialCost = 0;
      for (const item of materials) {
        const material = materialData.find(
          (mat) => mat._id.toString() === item.materialId
        );
        if (!material) {
          return response.error(
            res,
            `Material ID ${item.materialId} topilmadi`
          );
        }
        materialCost += material.price * item.quantity;
      }

      // Create and save Norma document
      const norma = await Norma.create({
        productName,
        category: category || null,
        salePrice,
        materials,
      });

      return response.success(res, "Norma muvaffaqiyatli yaratildi", norma);
    } catch (error) {
      return response.serverError(
        res,
        "Norma yaratishda xato yuz berdi",
        error.message
      );
    }
  }

  // async updateNorma(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const { productName, materials, salePrice, category } = req.body;

  //     // Validate required fields
  //     if (!productName || !materials) {
  //       return response.error(
  //         res,
  //         "Mahsulot nomi, materiallar yoki xarajatlar kiritilmagan"
  //       );
  //     }

  //     // Fetch material data for provided material IDs
  //     const materialIds = materials.map((item) => item.materialId);
  //     const materialData = await Material.find({ _id: { $in: materialIds } })
  //       .select("price")
  //       .lean();
  //     if (!materialData || materialData.length !== materialIds.length) {
  //       return response.error(res, "Bir yoki bir nechta materiallar topilmadi");
  //     }

  //     // Calculate material cost
  //     let materialCost = 0;
  //     for (const item of materials) {
  //       const material = materialData.find(
  //         (mat) => mat._id.toString() === item.materialId
  //       );
  //       materialCost += material.price * item.quantity;
  //     }

  //     // Update Norma document
  //     const norma = await Norma.findByIdAndUpdate(
  //       id,
  //       {
  //         productName,
  //         category: category || null,
  //         salePrice,
  //         materials,
  //       },
  //       { new: true, runValidators: true }
  //     ).lean();

  //     if (!norma) {
  //       return response.notFound(res, "Norma topilmadi");
  //     }

  //     // ---------------------------------------------------
  //     let updateFinishedProductsPrice = await FinishedProducts.findOneAndUpdate(
  //       { productName: norma.productName },
  //       {
  //         sellingPrice: salePrice,
  //       }
  //     );
  //     // ---------------------------------------------------

  //     return response.success(res, "Norma yangilandi", norma);
  //   } catch (error) {
  //     return response.serverError(
  //       res,
  //       "Norma yangilashda xato yuz berdi",
  //       error.message
  //     );
  //   }
  // }

  async updateNorma(req, res) {
    const session = await mongoose.startSession(); // Transaction sessiyasini boshlash
    session.startTransaction();

    try {
      const { id } = req.params;
      const { productName, materials, salePrice, category } = req.body;

      // Validate required fields
      if (!productName || !materials) {
        return response.error(
          res,
          "Mahsulot nomi, materiallar yoki xarajatlar kiritilmagan"
        );
      }

      // Fetch material data for provided material IDs
      const materialIds = materials.map((item) => item.materialId);
      const materialData = await Material.find({ _id: { $in: materialIds } })
        .select("price")
        .lean()
        .session(session); // Transaction sessiyasini qo‘shish

      if (!materialData || materialData.length !== materialIds.length) {
        await session.abortTransaction(); // Xatolik yuz bersa, transactionni bekor qilish
        session.endSession();
        return response.error(res, "Bir yoki bir nechta materiallar topilmadi");
      }

      // Calculate material cost
      let materialCost = 0;
      for (const item of materials) {
        const material = materialData.find(
          (mat) => mat._id.toString() === item.materialId
        );
        materialCost += material.price * item.quantity;
      }

      // Update Norma document
      const norma = await Norma.findByIdAndUpdate(
        id,
        {
          productName,
          category: category || null,
          salePrice,
          materials,
        },
        { new: true, runValidators: true, session } // Transaction sessiyasini qo‘shish
      ).lean();

      if (!norma) {
        await session.abortTransaction(); // Xatolik yuz bersa, transactionni bekor qilish
        session.endSession();
        return response.notFound(res, "Norma topilmadi");
      }

      // Update FinishedProducts price
      const updateFinishedProductsPrice =
        await FinishedProducts.findOneAndUpdate(
          { productName: norma.productName },
          {
            sellingPrice: salePrice,
          },
          { session } // Transaction sessiyasini qo‘shish
        );

      if (!updateFinishedProductsPrice) {
        await session.abortTransaction(); // Xatolik yuz bersa, transactionni bekor qilish
        session.endSession();
        return response.error(
          res,
          "Tayyor mahsulotlarni yangilashda xatolik yuz berdi"
        );
      }

      await session.commitTransaction(); // Transactionni muvaffaqiyatli yakunlash
      session.endSession();

      return response.success(res, "Norma yangilandi", norma);
    } catch (error) {
      await session.abortTransaction(); // Xatolik yuz bersa, transactionni bekor qilish
      session.endSession();
      return response.serverError(
        res,
        "Norma yangilashda xato yuz berdi",
        error.message
      );
    }
  }

  async deleteNorma(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return response.error(res, "Noto'g'ri ID formati");
      }
      const norma = await Norma.findByIdAndDelete(id);
      if (!norma) {
        return response.notFound(res, "Norma topilmadi");
      }
      return response.success(res, "Norma o'chirildi", norma);
    } catch (error) {
      return response.serverError(
        res,
        "Norma o'chirishda xato yuz berdi",
        error.message
      );
    }
  }
}

module.exports = new NormaController();
